using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Admin.Domain.Models
{
	public class Decision
	{
		public int Id { get; set; }
		public int ApplicationId { get; set; }
		public string AdminEmail { get; set; } = string.Empty;
		public string Status { get; set; } = string.Empty;
		public string Remarks { get; set; } = string.Empty;
		public string? SanctionTerms { get; set; }
		public DateTime DecisionDate { get; set; } = DateTime.UtcNow;
	}
}
