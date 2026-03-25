using CapFinLoan.Admin.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Admin.Persistence.Data;

public class AdminDbContext : DbContext
{
	public AdminDbContext(DbContextOptions<AdminDbContext> options) : base(options) { }

	public DbSet<Decision> Decisions => Set<Decision>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		modelBuilder.HasDefaultSchema("admin");

		modelBuilder.Entity<Decision>(e =>
		{
			e.HasKey(d => d.Id);
			e.Property(d => d.Status).HasMaxLength(50).IsRequired();
			e.Property(d => d.AdminEmail).HasMaxLength(200).IsRequired();
			e.Property(d => d.Remarks).HasMaxLength(1000);
			e.Property(d => d.SanctionTerms).HasMaxLength(2000);
		});
	}
}