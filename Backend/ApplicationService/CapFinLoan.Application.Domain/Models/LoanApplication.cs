using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Domain.Enums;

namespace CapFinLoan.Application.Domain.Models
{
	public class LoanApplication
	{
		public int Id { get; set; }

		
		public string ApplicantId { get; set; } = string.Empty;
		public string ApplicantName { get; set; } = string.Empty;
		public string ApplicantEmail { get; set; } = string.Empty;


		public string Phone { get; set; } = string.Empty;
		public string Address { get; set; } = string.Empty;
		public DateTime DateOfBirth { get; set; }


		public string EmployerName { get; set; } = string.Empty;
		public string EmploymentType { get; set; } = string.Empty; 
		public decimal MonthlyIncome { get; set; }

		
		public decimal LoanAmount { get; set; }
		public int TenureMonths { get; set; }
		public string LoanPurpose { get; set; } = string.Empty;


		public ApplicationStatus Status { get; set; } = ApplicationStatus.Draft;
		public string? StatusNote { get; set; }

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
		public DateTime? SubmittedAt { get; set; }
	}
}
