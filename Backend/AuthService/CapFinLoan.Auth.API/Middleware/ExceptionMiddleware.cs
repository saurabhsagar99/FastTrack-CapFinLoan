using System.Net;
using System.Text.Json;

namespace CapFinLoan.Auth.API.Middleware
{
	public class ExceptionMiddleware
	{
		private readonly RequestDelegate _next;
		private readonly ILogger<ExceptionMiddleware> _logger;

		public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
		{
			_next = next;
			_logger = logger;
		}

		public async Task InvokeAsync(HttpContext context)
		{
			try
			{
				await _next(context);
			}
			catch (UnauthorizedAccessException ex)
			{
				await WriteError(context, HttpStatusCode.Unauthorized, ex.Message);
			}
			catch (InvalidOperationException ex)
			{
				await WriteError(context, HttpStatusCode.BadRequest, ex.Message);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Unhandled exception");
				await WriteError(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
			}
		}

		private static Task WriteError(HttpContext ctx, HttpStatusCode code, string message)
		{
			ctx.Response.StatusCode = (int)code;
			ctx.Response.ContentType = "application/json";
			var body = JsonSerializer.Serialize(new { success = false, message });
			return ctx.Response.WriteAsync(body);
		}
	}
}
