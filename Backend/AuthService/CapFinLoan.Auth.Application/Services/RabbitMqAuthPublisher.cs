using System.Text;
using System.Text.Json;
using CapFinLoan.Auth.Application.DTOs;
using CapFinLoan.Auth.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace CapFinLoan.Auth.Application.Services
{
	public class RabbitMqAuthPublisher : IAuthMessagePublisher
	{
		private readonly IConfiguration _configuration;
		private readonly ILogger<RabbitMqAuthPublisher> _logger;

		public RabbitMqAuthPublisher(
			IConfiguration configuration,
			ILogger<RabbitMqAuthPublisher> logger)
		{
			_configuration = configuration;
			_logger = logger;
		}

		public Task PublishUserRegisteredAsync(
			AuthUserRegisteredEvent message,
			CancellationToken cancellationToken = default)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var routingKey = _configuration["RabbitMq:RoutingKeys:UserRegistered"] ?? "auth.user.registered";

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
					"Published auth.user.registered event for user {UserId}",
					message.UserId);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Failed to publish auth.user.registered event for user {UserId}", message.UserId);
			}

			return Task.CompletedTask;
		}
	}
}