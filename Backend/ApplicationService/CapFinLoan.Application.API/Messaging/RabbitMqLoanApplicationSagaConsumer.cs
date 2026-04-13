using System.Text;
using System.Text.Json;
using CapFinLoan.Application.Application.Interfaces;
using CapFinLoan.Application.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace CapFinLoan.Application.API.Messaging
{
	public class RabbitMqLoanApplicationSagaConsumer : BackgroundService
	{
		private readonly IConfiguration _configuration;
		private readonly IServiceScopeFactory _serviceScopeFactory;
		private readonly ILogger<RabbitMqLoanApplicationSagaConsumer> _logger;

		public RabbitMqLoanApplicationSagaConsumer(
			IConfiguration configuration,
			IServiceScopeFactory serviceScopeFactory,
			ILogger<RabbitMqLoanApplicationSagaConsumer> logger)
		{
			_configuration = configuration;
			_serviceScopeFactory = serviceScopeFactory;
			_logger = logger;
		}

		protected override Task ExecuteAsync(CancellationToken stoppingToken)
		{
			var host = _configuration["RabbitMq:Host"] ?? "localhost";
			var user = _configuration["RabbitMq:Username"] ?? "guest";
			var pass = _configuration["RabbitMq:Password"] ?? "guest";
			var exchange = _configuration["RabbitMq:Exchange"] ?? "capfinloan.exchange";
			var queue = _configuration["RabbitMq:Queues:Saga"] ?? "capfinloan.application.saga.queue";
			var submittedRoutingKey = _configuration["RabbitMq:RoutingKeys:ApplicationSubmitted"] ?? "application.submitted";
			var documentStatusRoutingKey = _configuration["RabbitMq:RoutingKeys:DocumentStatusUpdated"] ?? "document.status.updated";
			var decisionRoutingKey = _configuration["RabbitMq:RoutingKeys:DecisionCreated"] ?? "admin.decision.created";

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
						channel.QueueBind(queue, exchange, submittedRoutingKey);
						channel.QueueBind(queue, exchange, documentStatusRoutingKey);
						channel.QueueBind(queue, exchange, decisionRoutingKey);

						var consumer = new AsyncEventingBasicConsumer(channel);
						consumer.Received += async (_, ea) =>
						{
							try
							{
								var body = Encoding.UTF8.GetString(ea.Body.ToArray());
								await HandleMessageAsync(ea.RoutingKey, body);
								channel.BasicAck(ea.DeliveryTag, multiple: false);
							}
							catch (Exception ex)
							{
								_logger.LogError(ex, "Failed to process saga message with routing key {RoutingKey}", ea.RoutingKey);
								channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
							}

							await Task.CompletedTask;
						};

						channel.BasicConsume(queue, autoAck: false, consumer: consumer);
						_logger.LogInformation("Loan application saga consumer started for queue {Queue}", queue);

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
						_logger.LogWarning(ex, "RabbitMQ unavailable for loan application saga consumer. Retrying in 5 seconds...");
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

		private async Task HandleMessageAsync(string routingKey, string body)
		{
			using var scope = _serviceScopeFactory.CreateScope();
			var applicationService = scope.ServiceProvider.GetRequiredService<IApplicationService>();

			switch (routingKey)
			{
				case "application.submitted":
				{
					var message = JsonSerializer.Deserialize<ApplicationSubmittedEvent>(body);
					if (message != null)
					{
						await applicationService.ProcessSagaTransitionAsync(
							message.ApplicationId,
							ApplicationStatus.DocsPending,
							"Documents pending after application submission.",
							"application.submitted");
					}

					break;
				}
				case "document.status.updated":
				{
					var message = JsonSerializer.Deserialize<DocumentStatusUpdatedEvent>(body);
					if (message != null)
					{
						var nextStatus = message.IsVerified
							? ApplicationStatus.DocsVerified
							: ApplicationStatus.Rejected;
						var nextNote = message.IsVerified
							? "Documents verified. Awaiting admin review."
							: string.IsNullOrWhiteSpace(message.VerificationRemarks)
								? "Document verification rejected."
								: message.VerificationRemarks;

						await applicationService.ProcessSagaTransitionAsync(
							message.ApplicationId,
							nextStatus,
							nextNote,
							"document.status.updated");
					}

					break;
				}
				case "admin.decision.created":
				{
					var message = JsonSerializer.Deserialize<AdminDecisionCreatedEvent>(body);
					if (message != null)
					{
						var approved = string.Equals(message.Status, "Approved", StringComparison.OrdinalIgnoreCase);
						var nextStatus = approved ? ApplicationStatus.Approved : ApplicationStatus.Rejected;
						var nextNote = approved
							? message.SanctionTerms ?? message.Remarks ?? "Loan approved by admin."
							: message.Remarks ?? "Loan rejected by admin.";

						await applicationService.ProcessSagaTransitionAsync(
							message.ApplicationId,
							nextStatus,
							nextNote,
							"admin.decision.created");
					}

					break;
				}
			}
		}
	}
}