using System.Text;
using System.Text.Json;
using CapFinLoan.Application.Application.DTOs;
using CapFinLoan.Application.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace CapFinLoan.Application.Application.Services
{
	public class RabbitMqPublisher : IMessagePublisher
	{
		private readonly IConfiguration _configuration;
		private readonly ILogger<RabbitMqPublisher> _logger;

		public RabbitMqPublisher(
			IConfiguration configuration,
			ILogger<RabbitMqPublisher> logger)
		{
			_configuration = configuration;
			_logger = logger;
		}

		public Task PublishApplicationStatusChangedAsync(
			ApplicationStatusChangedEvent message,
			CancellationToken cancellationToken = default)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var routingKey = _configuration["RabbitMq:RoutingKeys:ApplicationStatusChanged"]
				?? "application.status.changed";

			try
			{
				var factory = new ConnectionFactory
				{
					HostName = host,
					UserName = user,
					Password = pass,
					DispatchConsumersAsync = true
				};

				using var connection = factory.CreateConnection();
				using var channel = connection.CreateModel();

				channel.ExchangeDeclare(
					exchange: exchange,
					type: ExchangeType.Topic,
					durable: true,
					autoDelete: false);

				var payload = JsonSerializer.Serialize(message);
				var body = Encoding.UTF8.GetBytes(payload);

				var props = channel.CreateBasicProperties();
				props.Persistent = true;

				channel.BasicPublish(
					exchange: exchange,
					routingKey: routingKey,
					basicProperties: props,
					body: body);

				_logger.LogInformation(
					"Published RabbitMQ event for application {ApplicationId} with status {Status}",
					message.ApplicationId,
					message.Status);
			}
			catch (Exception ex)
			{
				_logger.LogError(
					ex,
					"Failed to publish RabbitMQ message for application {ApplicationId}",
					message.ApplicationId);
			}

			return Task.CompletedTask;
		}
	}
}