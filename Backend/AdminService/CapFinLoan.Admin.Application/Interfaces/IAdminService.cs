using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Interfaces
{
	public interface IAdminService
	{
		Task<IEnumerable<object>> GetApplicationQueueAsync();
		Task<Decision> MakeDecisionAsync(DecisionDto dto, string adminEmail);
		Task<object> GetReportsSummaryAsync();
	}
}
