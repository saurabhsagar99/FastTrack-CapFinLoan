using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Interfaces
{
	public interface IDecisionRepository
	{
		Task<IEnumerable<Decision>> GetAllAsync();
		Task<Decision> AddAsync(Decision decision);
		Task<int> CountAsync();
		Task<int> CountByStatusAsync(string status);
	}
}
