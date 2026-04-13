using CapFinLoan.Application.Domain.Models;

namespace CapFinLoan.Application.Persistence.Repositories
{
	public interface ILoanApplicationSagaRepository
	{
		Task<LoanApplicationSagaState?> GetByApplicationIdAsync(int applicationId);
		Task<LoanApplicationSagaState> UpsertAsync(LoanApplicationSagaState state);
	}
}