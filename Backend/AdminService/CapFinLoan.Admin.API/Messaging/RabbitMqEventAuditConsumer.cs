using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace CapFinLoan.Admin.API.Messaging;

public class RabbitMqEventAuditConsumer : BackgroundService
{
	private readonly IConfiguration _configuration;
	private readonly ILogger<RabbitMqEventAuditConsumer> _logger;

	public RabbitMqEventAuditConsumer(
		IConfiguration configuration,
		ILogger<RabbitMqEventAuditConsumer> logger)
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
		var queue = _configuration["RabbitMq:Queues:Audit"] ?? "capfinloan.admin.audit.queue";

		var userRegisteredRoutingKey = _configuration["RabbitMq:RoutingKeys:UserRegistered"]
			?? "auth.user.registered";
		var applicationSubmittedRoutingKey = _configuration["RabbitMq:RoutingKeys:ApplicationSubmitted"]
			?? "application.submitted";
		var documentStatusUpdatedRoutingKey = _configuration["RabbitMq:RoutingKeys:DocumentStatusUpdated"]
			?? "document.status.updated";

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

					channel.ExchangeDeclare(exchange, ExchangeType.Topic, durable: true, autoDelete: false);
					channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false, arguments: null);

					channel.QueueBind(queue, exchange, userRegisteredRoutingKey);
					channel.QueueBind(queue, exchange, applicationSubmittedRoutingKey);
					channel.QueueBind(queue, exchange, documentStatusUpdatedRoutingKey);

					var consumer = new AsyncEventingBasicConsumer(channel);
					consumer.Received += async (_, ea) =>
					{
						try
						{
							var body = Encoding.UTF8.GetString(ea.Body.ToArray());
							_logger.LogInformation(
								"Admin audit event received. RoutingKey={RoutingKey}, Payload={Payload}",
								ea.RoutingKey,
								body);

							channel.BasicAck(ea.DeliveryTag, multiple: false);
						}
						catch (Exception ex)
						{
							_logger.LogError(ex, "Failed to process admin audit event");
							channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
						}

						await Task.CompletedTask;
					};

					channel.BasicConsume(queue, autoAck: false, consumer: consumer);
					_logger.LogInformation("Admin audit consumer started for queue {Queue}", queue);

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
					_logger.LogWarning(ex, "RabbitMQ unavailable for admin audit consumer. Retrying in 5 seconds...");
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