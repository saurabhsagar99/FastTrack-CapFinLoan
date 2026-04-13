using CapFinLoan.Application.Domain.Models;
using CapFinLoan.Application.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Application.Persistence.Repositories
{
	public class LoanApplicationSagaRepository : ILoanApplicationSagaRepository
	{
		private readonly ApplicationDbContext _context;

		public LoanApplicationSagaRepository(ApplicationDbContext context)
		{
			_context = context;
		}

		public async Task<LoanApplicationSagaState?> GetByApplicationIdAsync(int applicationId)
		{
			return await _context.LoanApplicationSagaStates
				.FirstOrDefaultAsync(state => state.ApplicationId == applicationId);
		}

		public async Task<LoanApplicationSagaState> UpsertAsync(LoanApplicationSagaState state)
		{
			var existing = await _context.LoanApplicationSagaStates
				.FirstOrDefaultAsync(item => item.ApplicationId == state.ApplicationId);

			if (existing is null)
			{
				_context.LoanApplicationSagaStates.Add(state);
				existing = state;
			}
			else
			{
				existing.CurrentStep = state.CurrentStep;
				existing.LastEventName = state.LastEventName;
				existing.LastMessage = state.LastMessage;
				existing.IsCompleted = state.IsCompleted;
				existing.StartedAtUtc = state.StartedAtUtc;
				existing.UpdatedAtUtc = state.UpdatedAtUtc;
				existing.CompletedAtUtc = state.CompletedAtUtc;
			}

			await _context.SaveChangesAsync();
			return existing;
		}
	}
}