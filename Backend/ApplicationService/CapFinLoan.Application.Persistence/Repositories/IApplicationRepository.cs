using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Domain.Models;

namespace CapFinLoan.Application.Persistence.Repositories
{
	public interface IApplicationRepository
	{
		Task<LoanApplication?> GetByIdAsync(int id);
		Task<IEnumerable<LoanApplication>> GetByApplicantIdAsync(string applicantId);
		Task<IEnumerable<LoanApplication>> GetAllAsync();
		Task<LoanApplication> CreateAsync(LoanApplication application);
		Task<LoanApplication> UpdateAsync(LoanApplication application);
		Task<bool> ExistsAsync(int id);
	}
}
