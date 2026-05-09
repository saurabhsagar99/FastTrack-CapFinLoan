using CapFinLoan.Admin.API.Extensions;
using CapFinLoan.Admin.API.Middleware;
using CapFinLoan.Admin.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Admin.API
{
	/// <summary>
	/// Application entry point for the Admin API.
	/// </summary>
	public class Program
	{
		public static void Main(string[] args)
		{
			var builder = WebApplication.CreateBuilder(args);

			// Add services to the container.

			builder.Services.AddControllers();

			builder.Services.AddEndpointsApiExplorer();
			builder.Services.AddSwaggerGen();
			builder.Services.AddApplicationServices(builder.Configuration);

			var app = builder.Build();

			using (var scope = app.Services.CreateScope())
			{
				var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
				db.Database.Migrate();
			}

			// Configure the HTTP request pipeline.

			app.UseSwagger();
			app.UseSwaggerUI();
			app.UseMiddleware<ExceptionMiddleware>();
			app.UseAuthentication();

			app.UseAuthorization();


			app.MapControllers();

			app.Run();
		}
	}
}
