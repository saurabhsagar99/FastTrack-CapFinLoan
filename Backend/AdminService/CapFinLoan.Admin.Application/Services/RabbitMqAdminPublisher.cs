using System.Text;
using System.Text.Json;
using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace CapFinLoan.Admin.Application.Services
{
	public class RabbitMqAdminPublisher : IAdminMessagePublisher
	{
		private readonly IConfiguration _configuration;
		private readonly ILogger<RabbitMqAdminPublisher> _logger;

		public RabbitMqAdminPublisher(
			IConfiguration configuration,
			ILogger<RabbitMqAdminPublisher> logger)
		{
			_configuration = configuration;
			_logger = logger;
		}

		public Task PublishDecisionCreatedAsync(
			AdminDecisionCreatedEvent message,
			CancellationToken cancellationToken = default)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var routingKey = _configuration["RabbitMq:RoutingKeys:DecisionCreated"] ?? "admin.decision.created";

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

				var properties = channel.CreateBasicProperties();
				properties.Persistent = true;

				channel.BasicPublish(
					exchange: exchange,
					routingKey: routingKey,
					basicProperties: properties,
					body: body);

				_logger.LogInformation(
					"Published admin.decision.created event for application {ApplicationId}",
					message.ApplicationId);
			}
			catch (Exception ex)
			{
				_logger.LogError(
					ex,
					"Failed to publish admin.decision.created event for application {ApplicationId}",
					message.ApplicationId);
			}

			return Task.CompletedTask;
		}
	}
}