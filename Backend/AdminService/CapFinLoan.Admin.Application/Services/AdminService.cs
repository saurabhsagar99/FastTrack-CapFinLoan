using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Services;

public class AdminService : IAdminService
{
	private readonly IDecisionRepository _repository;

	public AdminService(IDecisionRepository repository)
	{
		_repository = repository;
	}

	public async Task<IEnumerable<object>> GetApplicationQueueAsync()
	{
		var decisions = await _repository.GetAllAsync();
		return decisions.Select(d => new
		{
			d.Id,
			d.ApplicationId,
			d.Status,
			d.AdminEmail,
			d.DecisionDate
		});
	}

	public async Task<Decision> MakeDecisionAsync(DecisionDto dto, string adminEmail)
	{
		var decision = new Decision
		{
			ApplicationId = dto.ApplicationId,
			Status = dto.Status,
			Remarks = dto.Remarks,
			SanctionTerms = dto.SanctionTerms,
			AdminEmail = adminEmail,
			DecisionDate = DateTime.UtcNow
		};

		return await _repository.AddAsync(decision);
	}

	public async Task<object> GetReportsSummaryAsync()
	{
		var total = await _repository.CountAsync();
		var approved = await _repository.CountByStatusAsync("Approved");
		var rejected = await _repository.CountByStatusAsync("Rejected");

		return new { Total = total, Approved = approved, Rejected = rejected };
	}
}