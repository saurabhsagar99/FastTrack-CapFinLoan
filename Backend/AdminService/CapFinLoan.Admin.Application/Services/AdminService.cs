using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Services;

public class AdminService : IAdminService
{
	private readonly IDecisionRepository _repository;
	private readonly IUserRepository _userRepository;

	public AdminService(IDecisionRepository repository, IUserRepository userRepository)
	{
		_repository = repository;
		_userRepository = userRepository;
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

	public async Task<IEnumerable<object>> GetAllUsersAsync()
	{
		var users = await _userRepository.GetAllAsync();
		return users.Select(u => new
		{
			u.Id,
			u.Email,
			u.FullName,
			u.Role,
			u.IsActive,
			u.CreatedAt,
			u.LastLogin
		});
	}

	public async Task<object> ToggleUserStatusAsync(string id, bool isActive)
	{
		var user = await _userRepository.GetByIdAsync(id);
		if (user == null)
		{
			return new { Success = false, Message = "User not found" };
		}

		user.IsActive = isActive;
		await _userRepository.UpdateAsync(user);

		return new { Success = true, Message = "User status updated successfully", User = new { user.Id, user.Email, user.IsActive } };
	}
}