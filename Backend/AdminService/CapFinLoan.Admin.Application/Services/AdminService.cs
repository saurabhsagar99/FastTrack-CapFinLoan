using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Services;

/// <summary>
/// Implements admin-side decision and reporting workflows.
/// </summary>
public class AdminService : IAdminService
{
	private readonly IDecisionRepository _repository;
	private readonly IUserRepository _userRepository;
	private readonly IAdminMessagePublisher _messagePublisher;

	public AdminService(
		IDecisionRepository repository,
		IUserRepository userRepository,
		IAdminMessagePublisher messagePublisher)
	{
		_repository = repository;
		_userRepository = userRepository;
		_messagePublisher = messagePublisher;
	}

	/// <summary>
	/// Returns the current decision queue for admin review.
	/// </summary>
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

	/// <summary>
	/// Creates or updates a decision and publishes the corresponding event.
	/// </summary>
	public async Task<Decision> MakeDecisionAsync(int applicationId, DecisionDto dto, string adminEmail)
	{
		var existingDecision = await _repository.GetByApplicationIdAsync(applicationId);
		Decision savedDecision;

		if (existingDecision is not null)
		{
			existingDecision.Status = dto.Status;
			existingDecision.Remarks = dto.Remarks;
			existingDecision.SanctionTerms = dto.SanctionTerms;
			existingDecision.AdminEmail = adminEmail;
			existingDecision.DecisionDate = DateTime.UtcNow;

			savedDecision = await _repository.UpdateAsync(existingDecision);
		}
		else
		{
			var decision = new Decision
			{
				ApplicationId = applicationId,
				Status = dto.Status,
				Remarks = dto.Remarks,
				SanctionTerms = dto.SanctionTerms,
				AdminEmail = adminEmail,
				DecisionDate = DateTime.UtcNow
			};

			savedDecision = await _repository.AddAsync(decision);
		}

		await _messagePublisher.PublishDecisionCreatedAsync(new AdminDecisionCreatedEvent
		{
			DecisionId = savedDecision.Id,
			ApplicationId = savedDecision.ApplicationId,
			Status = savedDecision.Status,
			Remarks = savedDecision.Remarks,
			SanctionTerms = savedDecision.SanctionTerms,
			AdminEmail = savedDecision.AdminEmail,
			DecisionDateUtc = savedDecision.DecisionDate
		});

		return savedDecision;
	}

	/// <summary>
	/// Returns a simple summary for dashboard reporting.
	/// </summary>
	public async Task<object> GetReportsSummaryAsync()
	{
		var total = await _repository.CountAsync();
		var approved = await _repository.CountByStatusAsync("Approved");
		var rejected = await _repository.CountByStatusAsync("Rejected");

		return new { Total = total, Approved = approved, Rejected = rejected };
	}

	/// <summary>
	/// Returns the user list shown in the admin console.
	/// </summary>
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

	/// <summary>
	/// Enables or disables a user account.
	/// </summary>
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