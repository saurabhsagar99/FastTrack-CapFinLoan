using System.Text;
using CapFinLoan.Application.API.Messaging;
using CapFinLoan.Application.Application.Interfaces;
using CapFinLoan.Application.Application.Services;
using CapFinLoan.Application.Persistence.Data;
using CapFinLoan.Application.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CapFinLoan.Application.API.Extensions
{
	public static class ServiceExtensions
	{
		public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration config)
		{
			services.AddDbContext<ApplicationDbContext>(options =>
				options.UseSqlServer(config.GetConnectionString("DefaultConnection")));

			return services;
		}

		public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration config)
		{
			var key = Encoding.UTF8.GetBytes(config["Jwt:Key"]!);

			services.AddAuthentication(options =>
			{
				options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
				options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
			})
			.AddJwtBearer(options =>
			{
				options.TokenValidationParameters = new TokenValidationParameters
				{
					ValidateIssuerSigningKey = true,
					IssuerSigningKey = new SymmetricSecurityKey(key),
					ValidateIssuer = true,
					ValidIssuer = config["Jwt:Issuer"],
					ValidateAudience = true,
					ValidAudience = config["Jwt:Audience"],
					ValidateLifetime = true,
					ClockSkew = TimeSpan.Zero
				};
			});

			return services;
		}

		public static IServiceCollection AddApplicationServices(this IServiceCollection services)
		{
			services.AddScoped<IApplicationRepository, ApplicationRepository>();
			services.AddScoped<ILoanApplicationSagaRepository, LoanApplicationSagaRepository>();
			services.AddScoped<IMessagePublisher, RabbitMqPublisher>();
			services.AddScoped<IApplicationService, ApplicationService>();
			services.AddHostedService<RabbitMqLoanApplicationSagaConsumer>();
			return services;
		}
	}
}
