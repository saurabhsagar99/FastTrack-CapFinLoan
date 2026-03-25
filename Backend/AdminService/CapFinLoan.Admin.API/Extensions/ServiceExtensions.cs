using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Application.Services;
using CapFinLoan.Admin.Persistence.Data;
using CapFinLoan.Admin.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace CapFinLoan.Admin.API.Extensions;

public static class ServiceExtensions
{
	public static IServiceCollection AddApplicationServices(
		this IServiceCollection services,
		IConfiguration config)
	{
		services.AddDbContext<AdminDbContext>(options =>
			options.UseSqlServer(config.GetConnectionString("AdminDb")));

		services.AddScoped<IDecisionRepository, DecisionRepository>();

		services.AddScoped<IAdminService, AdminService>();

		var jwtKey = config["Jwt:Key"]!;
		services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
			.AddJwtBearer(options =>
			{
				options.TokenValidationParameters = new TokenValidationParameters
				{
					ValidateIssuerSigningKey = true,
					IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
					ValidateIssuer = true,
					ValidIssuer = config["Jwt:Issuer"],
					ValidateAudience = true,
					ValidAudience = config["Jwt:Audience"]
				};
			});

		services.AddAuthorization();
		return services;
	}
}