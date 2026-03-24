using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Application.Services;
using CapFinLoan.Document.Infrastructure.Services;        
using CapFinLoan.Document.Persistence.Data;
using CapFinLoan.Document.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace CapFinLoan.Document.API.Extensions
{
	public static class ServiceExtensions
	{
		public static IServiceCollection AddDocumentServices(
			this IServiceCollection services,
			IConfiguration config)
		{
			services.AddDbContext<DocumentDbContext>(opt =>
				opt.UseSqlServer(config.GetConnectionString("DocumentDb")));

			services.AddScoped<IDocumentRepository, DocumentRepository>();
			services.AddScoped<IFileStorageService, LocalFileStorageService>();  
			services.AddScoped<IDocumentService, DocumentService>();

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