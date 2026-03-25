using CapFinLoan.Auth.API.Extensions;
using CapFinLoan.Auth.API.Middleware;
using CapFinLoan.Auth.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Auth.API

{
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
				var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
				db.Database.Migrate();
				AuthDbSeeder.SeedAdminAsync(db, builder.Configuration).GetAwaiter().GetResult();
			}

			// Configure the HTTP request pipeline.

			if (app.Environment.IsDevelopment())
			{
				app.UseSwagger();
				app.UseSwaggerUI();
			}
			app.UseMiddleware<ExceptionMiddleware>();
			app.UseAuthentication();
			app.UseAuthorization();
			app.MapControllers();
			app.Run();
		}
	}
}
