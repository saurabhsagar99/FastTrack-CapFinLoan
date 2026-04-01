using CapFinLoan.Document.API.Extensions;
using CapFinLoan.Document.API.Middleware;
using CapFinLoan.Document.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Document.API
{
	public class Program
	{
		public static void Main(string[] args)
		{
			var builder = WebApplication.CreateBuilder(args);

			// Add services to the container.

			builder.Services.AddDocumentServices(builder.Configuration, builder.Environment);
			builder.Services.AddControllers();
			builder.Services.AddEndpointsApiExplorer();
			builder.Services.AddSwaggerGen();

			var app = builder.Build();

			using (var scope = app.Services.CreateScope())
			{
				var db = scope.ServiceProvider.GetRequiredService<DocumentDbContext>();
				db.Database.Migrate();
			}

			app.UseMiddleware<ExceptionMiddleware>();

			// Configure the HTTP request pipeline.

			if (app.Environment.IsDevelopment())
			{
				app.UseSwagger();
				app.UseSwaggerUI();
			}

			app.UseAuthentication();

			app.UseAuthorization();


			app.MapControllers();

			app.Run();
		}
	}
}

