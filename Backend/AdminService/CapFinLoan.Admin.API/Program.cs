using CapFinLoan.Admin.API.Extensions;
using CapFinLoan.Admin.API.Middleware;

namespace CapFinLoan.Admin.API
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
