using CapFinLoan.Application.API.Extensions;
using CapFinLoan.Application.API.Middleware;
using CapFinLoan.Application.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Application.API
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
			builder.Services.AddDatabase(builder.Configuration);
			builder.Services.AddJwtAuthentication(builder.Configuration);
			builder.Services.AddApplicationServices(builder.Configuration);

			builder.Services.AddCors(options =>
			{
				options.AddPolicy("AllowAll", policy =>
					policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
			});

			var app = builder.Build();

			using (var scope = app.Services.CreateScope())
			{
				var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
				db.Database.Migrate();
			}

			if (app.Environment.IsDevelopment())
			{
				app.UseSwagger();
				app.UseSwaggerUI();
			}

			// Configure the HTTP request pipeline.

			app.UseMiddleware<ExceptionMiddleware>();
			app.UseCors("AllowAll");
			app.UseAuthentication();

			app.UseAuthorization();


			app.MapControllers();

			app.Run();
		}
	}
}
