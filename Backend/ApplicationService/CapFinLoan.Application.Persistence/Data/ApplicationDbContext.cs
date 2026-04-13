using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Application.Persistence.Data
{
	public class ApplicationDbContext:DbContext
	{
		public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
			   : base(options) { }

		public DbSet<LoanApplication> LoanApplications { get; set; }
		public DbSet<LoanApplicationSagaState> LoanApplicationSagaStates { get; set; }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.HasDefaultSchema("core");

			modelBuilder.Entity<LoanApplication>(entity =>
			{
				entity.HasKey(e => e.Id);

				entity.Property(e => e.ApplicantId)
					  .IsRequired()
					  .HasMaxLength(100);

				entity.Property(e => e.ApplicantName)
					  .IsRequired()
					  .HasMaxLength(150);

				entity.Property(e => e.ApplicantEmail)
					  .IsRequired()
					  .HasMaxLength(150);

				entity.Property(e => e.Phone).HasMaxLength(20);
				entity.Property(e => e.Address).HasMaxLength(300);

				entity.Property(e => e.EmployerName).HasMaxLength(150);
				entity.Property(e => e.EmploymentType).HasMaxLength(50);

				entity.Property(e => e.LoanAmount)
					  .HasColumnType("decimal(18,2)");

				entity.Property(e => e.MonthlyIncome)
					  .HasColumnType("decimal(18,2)");

				entity.Property(e => e.LoanPurpose).HasMaxLength(300);

				entity.Property(e => e.Status)
					  .HasConversion<string>()
					  .HasMaxLength(50);

				entity.Property(e => e.StatusNote).HasMaxLength(500);
			});

			modelBuilder.Entity<LoanApplicationSagaState>(entity =>
			{
				entity.HasKey(e => e.Id);
				entity.HasIndex(e => e.ApplicationId).IsUnique();
				entity.Property(e => e.ApplicationId).IsRequired();

				entity.Property(e => e.CurrentStep)
					.IsRequired()
					.HasMaxLength(50);

				entity.Property(e => e.LastEventName)
					.IsRequired()
					.HasMaxLength(100);

				entity.Property(e => e.LastMessage)
					.HasMaxLength(500);
			});
		}
		}
}
