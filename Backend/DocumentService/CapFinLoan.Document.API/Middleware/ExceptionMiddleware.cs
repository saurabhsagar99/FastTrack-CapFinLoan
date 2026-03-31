using System.Net;
using System.Text.Json;

namespace CapFinLoan.Document.API.Middleware
{
	public class ExceptionMiddleware
	{
		private readonly RequestDelegate _next;

		public ExceptionMiddleware(RequestDelegate next) => _next = next;

		public async Task InvokeAsync(HttpContext context)
		{
			try
			{
				await _next(context);
			}
			catch (InvalidOperationException ex)
			{
				await WriteError(context, HttpStatusCode.BadRequest, ex.Message);
			}
			catch (KeyNotFoundException ex)
			{
				await WriteError(context, HttpStatusCode.NotFound, ex.Message);
			}
			catch (FileNotFoundException ex)
			{
				await WriteError(context, HttpStatusCode.NotFound, ex.Message ?? "File not found.");
			}
			catch (UnauthorizedAccessException ex)
			{
				await WriteError(context, HttpStatusCode.Unauthorized, ex.Message);
			}
			catch (Exception ex)
			{
				await WriteError(context, HttpStatusCode.InternalServerError, "An unexpected error occurred: " + ex.Message);
			}
		}

		private static async Task WriteError(HttpContext ctx, HttpStatusCode code, string message)
		{
			ctx.Response.StatusCode = (int)code;
			ctx.Response.ContentType = "application/json";
			var body = JsonSerializer.Serialize(new { success = false, message });
			await ctx.Response.WriteAsync(body);
		}
	
}
}
