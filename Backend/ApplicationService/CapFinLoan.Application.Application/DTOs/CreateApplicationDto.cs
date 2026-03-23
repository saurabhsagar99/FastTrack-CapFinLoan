using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace CapFinLoan.Application.Application.DTOs
{
	public class CreateApplicationDto
	{
		[Required]
		[MaxLength(150)]
		public string ApplicantName { get; set; } = string.Empty;

		[Required]
		[EmailAddress]
		public string ApplicantEmail { get; set; } = string.Empty;

		[Required]
		[Phone]
		public string Phone { get; set; } = string.Empty;

		[Required]
		public string Address { get; set; } = string.Empty;

		[Required]
		public DateTime DateOfBirth { get; set; }

		[Required]
		public string EmployerName { get; set; } = string.Empty;

		[Required]
		public string EmploymentType { get; set; } = string.Empty;

		[Required]
		[Range(1, double.MaxValue, ErrorMessage = "Monthly income must be greater than 0")]
		public decimal MonthlyIncome { get; set; }

		[Required]
		[Range(1000, 10000000, ErrorMessage = "Loan amount must be between 1,000 and 10,000,000")]
		public decimal LoanAmount { get; set; }

		[Required]
		[Range(3, 360, ErrorMessage = "Tenure must be between 3 and 360 months")]
		public int TenureMonths { get; set; }

		[Required]
		[MaxLength(300)]
		public string LoanPurpose { get; set; } = string.Empty;
	}
}
