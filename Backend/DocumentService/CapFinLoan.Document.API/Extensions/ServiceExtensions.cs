using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Application.Services;
using CapFinLoan.Document.API.Messaging;
using CapFinLoan.Document.Infrastructure.Services;        
using CapFinLoan.Document.Persistence.Data;
using CapFinLoan.Document.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace CapFinLoan.Document.API.Extensions
{
	public static class ServiceExtensions
	{
		public static IServiceCollection AddDocumentServices(
			this IServiceCollection services,
			IConfiguration config,
			IWebHostEnvironment environment)
		{
			services.AddDbContext<DocumentDbContext>(opt =>
				opt.UseSqlServer(config.GetConnectionString("DocumentDb")));

			var relativeBasePath = config["FileStorage:BasePath"] ?? "Uploads";
			var absoluteBasePath = Path.Combine(environment.ContentRootPath, relativeBasePath);

			services.AddScoped<IDocumentRepository, DocumentRepository>();
			services.AddScoped<IFileStorageService>(_ => new LocalFileStorageService(absoluteBasePath));
			services.AddScoped<IDocumentMessagePublisher, RabbitMqDocumentPublisher>();
			services.AddScoped<IDocumentService, DocumentService>();
			services.AddHostedService<RabbitMqApplicationStatusConsumer>();

			services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
				.AddJwtBearer(opt =>
				{
					opt.TokenValidationParameters = new TokenValidationParameters
					{
						ValidateIssuer = true,
						ValidateAudience = true,
						ValidateLifetime = true,
						ValidateIssuerSigningKey = true,
						ValidIssuer = config["Jwt:Issuer"],
						ValidAudience = config["Jwt:Audience"],
						IssuerSigningKey = new SymmetricSecurityKey(
							Encoding.UTF8.GetBytes(config["Jwt:Key"]!))
					};
				});

			services.AddAuthorization();
			return services;
		}
	}
}