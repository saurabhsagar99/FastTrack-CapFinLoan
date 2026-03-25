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

	public async Task<Decision> MakeDecisionAsync(int applicationId, DecisionDto dto, string adminEmail)
	{
		var existingDecision = await _repository.GetByApplicationIdAsync(applicationId);

		if (existingDecision is not null)
		{
			existingDecision.Status = dto.Status;
			existingDecision.Remarks = dto.Remarks;
			existingDecision.SanctionTerms = dto.SanctionTerms;
			existingDecision.AdminEmail = adminEmail;
			existingDecision.DecisionDate = DateTime.UtcNow;

			return await _repository.UpdateAsync(existingDecision);
		}

		var decision = new Decision
		{
			ApplicationId = applicationId,
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