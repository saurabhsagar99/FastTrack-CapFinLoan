using System.Text;
using System.Text.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace CapFinLoan.Document.API.Messaging
{
	public class RabbitMqApplicationStatusConsumer : BackgroundService
	{
		private readonly IConfiguration _configuration;
		private readonly ILogger<RabbitMqApplicationStatusConsumer> _logger;

		public RabbitMqApplicationStatusConsumer(
			IConfiguration configuration,
			ILogger<RabbitMqApplicationStatusConsumer> logger)
		{
			_configuration = configuration;
			_logger = logger;
		}

		protected override Task ExecuteAsync(CancellationToken stoppingToken)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var queue = _configuration["RabbitMq:Queue"] ?? "capfinloan.document.queue";
			var statusChangedRoutingKey = _configuration["RabbitMq:RoutingKeys:ApplicationStatusChanged"]
				?? "application.status.changed";
			var submittedRoutingKey = _configuration["RabbitMq:RoutingKeys:ApplicationSubmitted"]
				?? "application.submitted";

			return Task.Run(async () =>
			{
				var factory = new ConnectionFactory
				{
					HostName = host,
					UserName = user,
					Password = pass,
					DispatchConsumersAsync = true
				};

				while (!stoppingToken.IsCancellationRequested)
				{
					IConnection? connection = null;
					IModel? channel = null;

					try
					{
						connection = factory.CreateConnection();
						channel = connection.CreateModel();

						channel.ExchangeDeclare(
							exchange: exchange,
							type: ExchangeType.Topic,
							durable: true,
							autoDelete: false);

						channel.QueueDeclare(
							queue: queue,
							durable: true,
							exclusive: false,
							autoDelete: false,
							arguments: null);

						channel.QueueBind(queue: queue, exchange: exchange, routingKey: statusChangedRoutingKey);
						channel.QueueBind(queue: queue, exchange: exchange, routingKey: submittedRoutingKey);

						var consumer = new AsyncEventingBasicConsumer(channel);
						consumer.Received += async (_, ea) =>
						{
							try
							{
								var json = Encoding.UTF8.GetString(ea.Body.ToArray());
								var message = JsonSerializer.Deserialize<ApplicationStatusChangedEvent>(json);

								if (message != null)
								{
									_logger.LogInformation(
										"Consumed application status event: ApplicationId={ApplicationId}, Status={Status}, Note={StatusNote}",
										message.ApplicationId,
										message.Status,
										message.StatusNote ?? "-");
								}

								channel.BasicAck(ea.DeliveryTag, multiple: false);
							}
							catch (Exception ex)
							{
								_logger.LogError(ex, "Failed to process RabbitMQ message");
								channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
							}

							await Task.CompletedTask;
						};

						channel.BasicConsume(queue: queue, autoAck: false, consumer: consumer);

						_logger.LogInformation("RabbitMQ consumer started for queue {Queue}", queue);

						while (!stoppingToken.IsCancellationRequested && connection.IsOpen)
						{
							await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
						}
					}
					catch (OperationCanceledException)
					{
						break;
					}
					catch (Exception ex)
					{
						_logger.LogWarning(ex, "RabbitMQ unavailable. Retrying in 5 seconds...");
						await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
					}
					finally
					{
						if (channel != null)
						{
							if (channel.IsOpen)
							{
								channel.Close();
							}
							channel.Dispose();
						}

						if (connection != null)
						{
							if (connection.IsOpen)
							{
								connection.Close();
							}
							connection.Dispose();
						}
					}
				}
			}, stoppingToken);
		}
	}
}