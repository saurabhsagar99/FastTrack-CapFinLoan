// API Gateway (Ocelot) entry point.
// Routes authenticated requests to microservices (Auth, Application, Admin, Document).
// Validates JWT tokens and enforces CORS for the React frontend.

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using System.Text;

public class Program
{
	// Initializes the Ocelot gateway with JWT authentication and CORS configuration.
	private static async Task Main(string[] args)
	{
		var builder = WebApplication.CreateBuilder(args);

		// Load Ocelot configuration from ocelot.json.
		builder.Configuration
			.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

		var jwtSettings = builder.Configuration.GetSection("Jwt");
		var key = Encoding.UTF8.GetBytes(jwtSettings["Key"]!);

		builder.Services
			.AddAuthentication(options =>
			{
				options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
				options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
			})
			.AddJwtBearer("Bearer", options =>
			{
				options.RequireHttpsMetadata = false;
				options.SaveToken = true;
				options.TokenValidationParameters = new TokenValidationParameters
				{
					ValidateIssuerSigningKey = true,
					IssuerSigningKey = new SymmetricSecurityKey(key),
					ValidateIssuer = true,
					ValidIssuer = jwtSettings["Issuer"],
					ValidateAudience = true,
					ValidAudience = jwtSettings["Audience"],
					ValidateLifetime = true,
					ClockSkew = TimeSpan.Zero
				};
			});

		builder.Services.AddCors(options =>
		{
			options.AddPolicy("AllowReact", policy =>
			{
				policy.WithOrigins(
						"http://localhost:5173"
					  )
					  .AllowAnyHeader()
					  .AllowAnyMethod()
					  .AllowCredentials();
			});
		});

		builder.Services.AddOcelot(builder.Configuration);

		var app = builder.Build();

		app.UseCors("AllowReact");
		app.UseAuthentication();
		app.UseAuthorization();

		await app.UseOcelot();
		await app.RunAsync();
	}
}