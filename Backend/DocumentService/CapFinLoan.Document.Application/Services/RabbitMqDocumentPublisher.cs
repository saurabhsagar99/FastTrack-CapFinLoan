using System.Text;
using System.Text.Json;
using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace CapFinLoan.Document.Application.Services
{
	public class RabbitMqDocumentPublisher : IDocumentMessagePublisher
	{
		private readonly IConfiguration _configuration;
		private readonly ILogger<RabbitMqDocumentPublisher> _logger;

		public RabbitMqDocumentPublisher(
			IConfiguration configuration,
			ILogger<RabbitMqDocumentPublisher> logger)
		{
			_configuration = configuration;
			_logger = logger;
		}

		public Task PublishDocumentStatusUpdatedAsync(
			DocumentStatusUpdatedEvent message,
			CancellationToken cancellationToken = default)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var routingKey = _configuration["RabbitMq:RoutingKeys:DocumentStatusUpdated"]
				?? "document.status.updated";

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
					"Published document status updated event for document {DocumentId}",
					message.DocumentId);
			}
			catch (Exception ex)
			{
				_logger.LogError(
					ex,
					"Failed to publish document status updated event for document {DocumentId}",
					message.DocumentId);
			}

			return Task.CompletedTask;
		}
	}
}