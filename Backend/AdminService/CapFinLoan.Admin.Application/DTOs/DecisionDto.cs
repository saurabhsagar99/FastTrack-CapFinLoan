using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Admin.Application.DTOs
{
	public class DecisionDto
	{
		public string Status { get; set; } = string.Empty;   
		public string Remarks { get; set; } = string.Empty;
		public string? SanctionTerms { get; set; }
	}
}
