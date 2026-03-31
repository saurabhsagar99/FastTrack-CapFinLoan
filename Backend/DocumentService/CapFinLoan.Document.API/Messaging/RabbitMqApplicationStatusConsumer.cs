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
			var routingKey = _configuration["RabbitMq:RoutingKeys:ApplicationStatusChanged"]
				?? "application.status.changed";

			var factory = new ConnectionFactory
			{
				HostName = host,
				UserName = user,
				Password = pass,
				DispatchConsumersAsync = true
			};

			var connection = factory.CreateConnection();
			var channel = connection.CreateModel();

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

			channel.QueueBind(queue: queue, exchange: exchange, routingKey: routingKey);

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

			stoppingToken.Register(() =>
			{
				channel.Close();
				connection.Close();
				channel.Dispose();
				connection.Dispose();
			});

			_logger.LogInformation("RabbitMQ consumer started for queue {Queue}", queue);
			return Task.Delay(Timeout.Infinite, stoppingToken);
		}
	}
}