using CapFinLoan.Auth.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CapFinLoan.Auth.Persistence.Data
{
	public static class AuthDbSeeder
	{
		public static async Task SeedAdminAsync(AuthDbContext db, IConfiguration config)
		{
			var adminEmail = config["AdminSeed:Email"] ?? "admin@capfinloan.com";
			var adminPassword = config["AdminSeed:Password"] ?? "Admin@123";
			var adminName = config["AdminSeed:Name"] ?? "System Admin";
			var adminPhone = config["AdminSeed:Phone"] ?? "9999999999";

			var adminExists = await db.Users.AnyAsync(u => u.Email == adminEmail);
			if (adminExists)
			{
				return;
			}

			var adminUser = new User
			{
				Name = adminName,
				Email = adminEmail,
				Phone = adminPhone,
				PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
				Role = "ADMIN",
				IsActive = true,
				CreatedAt = DateTime.UtcNow
			};

			db.Users.Add(adminUser);
			await db.SaveChangesAsync();
		}
	}
}