using System.Text;
using CapFinLoan.Auth.Application.Interfaces;
using CapFinLoan.Auth.Application.Services;
using CapFinLoan.Auth.Infrastructure.Services;
using CapFinLoan.Auth.Persistence.Data;
using CapFinLoan.Auth.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CapFinLoan.Auth.API.Extensions
{
	public static class ServiceExtensions
	{
		public static IServiceCollection AddApplicationServices(
		   this IServiceCollection services,
		   IConfiguration config)
		{
			services.AddDbContext<AuthDbContext>(opt =>
				opt.UseSqlServer(config.GetConnectionString("DefaultConnection")));

			services.AddScoped<IUserRepository, UserRepository>();
			services.AddScoped<IAuthService, AuthService>();
			services.AddScoped<IJwtService, JwtService>();
			services.AddScoped<IAuthMessagePublisher, RabbitMqAuthPublisher>();

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

			return services;
		}
		}
}
