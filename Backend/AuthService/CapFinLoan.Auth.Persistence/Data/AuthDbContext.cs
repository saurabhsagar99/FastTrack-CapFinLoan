using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Auth.Persistence.Data
{
	public class AuthDbContext:DbContext
	{
		public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }

		public DbSet<User> Users => Set<User>();

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.HasDefaultSchema("auth");

			modelBuilder.Entity<User>(e =>
			{
				e.HasKey(u => u.Id);
				e.HasIndex(u => u.Email).IsUnique();
				e.Property(u => u.Email).IsRequired().HasMaxLength(256);
				e.Property(u => u.Name).IsRequired().HasMaxLength(150);
				e.Property(u => u.Role).IsRequired().HasMaxLength(20);
			});
		}
	}
}
