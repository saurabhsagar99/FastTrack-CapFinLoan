using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace CapFinLoan.Application.Application.DTOs
{
	public class UpdateApplicationDto
	{
		[MaxLength(150)]
		public string? ApplicantName { get; set; }

		[Phone]
		public string? Phone { get; set; }

		public string? Address { get; set; }

		public DateTime? DateOfBirth { get; set; }

		public string? EmployerName { get; set; }

		public string? EmploymentType { get; set; }

		[Range(1, double.MaxValue)]
		public decimal? MonthlyIncome { get; set; }

		[Range(1000, 10000000)]
		public decimal? LoanAmount { get; set; }

		[Range(3, 360)]
		public int? TenureMonths { get; set; }

		[MaxLength(300)]
		public string? LoanPurpose { get; set; }
	}
}
