using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Document.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Document.Persistence.Data
{
	public class DocumentDbContext : DbContext
	{
		public DocumentDbContext(DbContextOptions<DocumentDbContext> options) : base(options) { }

		public DbSet<DocumentEntity> Documents { get; set; }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.HasDefaultSchema("docs");

			modelBuilder.Entity<DocumentEntity>(e =>
			{
				e.ToTable("Documents");
				e.HasKey(x => x.Id);
				e.Property(x => x.FileName).IsRequired().HasMaxLength(255);
				e.Property(x => x.FilePath).IsRequired().HasMaxLength(500);
				e.Property(x => x.DocumentType).IsRequired().HasMaxLength(50);
				e.Property(x => x.UserId).IsRequired().HasMaxLength(100);
			});
		}
	}
}
