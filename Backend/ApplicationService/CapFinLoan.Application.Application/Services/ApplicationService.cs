using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Application.Common;
using CapFinLoan.Application.Application.DTOs;
using CapFinLoan.Application.Application.Interfaces;
using CapFinLoan.Application.Domain.Enums;
using CapFinLoan.Application.Domain.Models;
using CapFinLoan.Application.Persistence.Repositories;

namespace CapFinLoan.Application.Application.Services
{
	public class ApplicationService:IApplicationService
	{
		private readonly IApplicationRepository _repository;
		private readonly IMessagePublisher _messagePublisher;

		public ApplicationService(
			IApplicationRepository repository,
			IMessagePublisher messagePublisher)
		{
			_repository = repository;
			_messagePublisher = messagePublisher;
		}

		public async Task<ApiResponse<ApplicationResponseDto>> CreateDraftAsync(string applicantId, CreateApplicationDto dto)
		{
			var application = new LoanApplication
			{
				ApplicantId = applicantId,
				ApplicantName = dto.ApplicantName,
				ApplicantEmail = dto.ApplicantEmail,
				Phone = dto.Phone,
				Address = dto.Address,
				DateOfBirth = dto.DateOfBirth,
				EmployerName = dto.EmployerName,
				EmploymentType = dto.EmploymentType,
				MonthlyIncome = dto.MonthlyIncome,
				LoanAmount = dto.LoanAmount,
				TenureMonths = dto.TenureMonths,
				LoanPurpose = dto.LoanPurpose,
				Status = ApplicationStatus.Draft,
				CreatedAt = DateTime.UtcNow,
				UpdatedAt = DateTime.UtcNow
			};

			var created = await _repository.CreateAsync(application);
			return ApiResponse<ApplicationResponseDto>.Ok(MapToDto(created), "Draft created successfully.");
		}

		public async Task<ApiResponse<ApplicationResponseDto>> UpdateDraftAsync(int id, string applicantId, UpdateApplicationDto dto)
		{
			var application = await _repository.GetByIdAsync(id);

			if (application == null)
				return ApiResponse<ApplicationResponseDto>.Fail("Application not found.");

			if (application.ApplicantId != applicantId)
				return ApiResponse<ApplicationResponseDto>.Fail("You are not authorised to update this application.");

			if (application.Status != ApplicationStatus.Draft)
				return ApiResponse<ApplicationResponseDto>.Fail("Only draft applications can be updated.");

			if (dto.ApplicantName != null) application.ApplicantName = dto.ApplicantName;
			if (dto.Phone != null) application.Phone = dto.Phone;
			if (dto.Address != null) application.Address = dto.Address;
			if (dto.DateOfBirth != null) application.DateOfBirth = dto.DateOfBirth.Value;
			if (dto.EmployerName != null) application.EmployerName = dto.EmployerName;
			if (dto.EmploymentType != null) application.EmploymentType = dto.EmploymentType;
			if (dto.MonthlyIncome != null) application.MonthlyIncome = dto.MonthlyIncome.Value;
			if (dto.LoanAmount != null) application.LoanAmount = dto.LoanAmount.Value;
			if (dto.TenureMonths != null) application.TenureMonths = dto.TenureMonths.Value;
			if (dto.LoanPurpose != null) application.LoanPurpose = dto.LoanPurpose;

			var updated = await _repository.UpdateAsync(application);
			return ApiResponse<ApplicationResponseDto>.Ok(MapToDto(updated), "Application updated successfully.");
		}

		public async Task<ApiResponse<ApplicationResponseDto>> SubmitApplicationAsync(int id, string applicantId)
		{
			var application = await _repository.GetByIdAsync(id);

			if (application == null)
				return ApiResponse<ApplicationResponseDto>.Fail("Application not found.");

			if (application.ApplicantId != applicantId)
				return ApiResponse<ApplicationResponseDto>.Fail("You are not authorised to submit this application.");

			if (application.Status != ApplicationStatus.Draft)
				return ApiResponse<ApplicationResponseDto>.Fail("Only draft applications can be submitted.");

			var errors = new List<string>();
			if (string.IsNullOrWhiteSpace(application.EmployerName)) errors.Add("Employer name is required.");
			if (application.MonthlyIncome <= 0) errors.Add("Monthly income is required.");
			if (application.LoanAmount <= 0) errors.Add("Loan amount is required.");
			if (application.TenureMonths <= 0) errors.Add("Tenure is required.");
			if (string.IsNullOrWhiteSpace(application.LoanPurpose)) errors.Add("Loan purpose is required.");

			if (errors.Any())
				return ApiResponse<ApplicationResponseDto>.Fail("Application is incomplete.", errors);

			application.Status = ApplicationStatus.Submitted;
			application.SubmittedAt = DateTime.UtcNow;
			application.UpdatedAt = DateTime.UtcNow;

			var updated = await _repository.UpdateAsync(application);
			var submittedEvent = new ApplicationStatusChangedEvent
			{
				ApplicationId = updated.Id,
				ApplicantId = updated.ApplicantId,
				Status = updated.Status.ToString(),
				StatusNote = updated.StatusNote,
				UpdatedAtUtc = updated.UpdatedAt
			};

			await _messagePublisher.PublishApplicationStatusChangedAsync(submittedEvent);
			await _messagePublisher.PublishApplicationSubmittedAsync(submittedEvent);
			return ApiResponse<ApplicationResponseDto>.Ok(MapToDto(updated), "Application submitted successfully.");
		}

		public async Task<ApiResponse<ApplicationResponseDto>> UpdateStatusByAdminAsync(int id, UpdateApplicationStatusDto dto)
		{
			var application = await _repository.GetByIdAsync(id);

			if (application == null)
				return ApiResponse<ApplicationResponseDto>.Fail("Application not found.");

			if (!Enum.TryParse<ApplicationStatus>(dto.Status, true, out var nextStatus))
				return ApiResponse<ApplicationResponseDto>.Fail("Invalid status value.");

			application.Status = nextStatus;
			application.StatusNote = dto.StatusNote;
			application.UpdatedAt = DateTime.UtcNow;

			var updated = await _repository.UpdateAsync(application);
			await _messagePublisher.PublishApplicationStatusChangedAsync(new ApplicationStatusChangedEvent
			{
				ApplicationId = updated.Id,
				ApplicantId = updated.ApplicantId,
				Status = updated.Status.ToString(),
				StatusNote = updated.StatusNote,
				UpdatedAtUtc = updated.UpdatedAt
			});
			return ApiResponse<ApplicationResponseDto>.Ok(MapToDto(updated), "Application status updated successfully.");
		}

		public async Task<ApiResponse<IEnumerable<ApplicationResponseDto>>> GetMyApplicationsAsync(string applicantId)
		{
			var applications = await _repository.GetByApplicantIdAsync(applicantId);
			var dtos = applications.Select(MapToDto);
			return ApiResponse<IEnumerable<ApplicationResponseDto>>.Ok(dtos);
		}

		public async Task<ApiResponse<ApplicationResponseDto>> GetByIdAsync(int id)
		{
			var application = await _repository.GetByIdAsync(id);

			if (application == null)
				return ApiResponse<ApplicationResponseDto>.Fail("Application not found.");

			return ApiResponse<ApplicationResponseDto>.Ok(MapToDto(application));
		}

		public async Task<ApiResponse<IEnumerable<ApplicationResponseDto>>> GetAllAsync()
		{
			var applications = await _repository.GetAllAsync();
			var dtos = applications.Select(MapToDto);
			return ApiResponse<IEnumerable<ApplicationResponseDto>>.Ok(dtos);
		}

		private static ApplicationResponseDto MapToDto(LoanApplication a) => new()
		{
			Id = a.Id,
			ApplicantId = a.ApplicantId,
			ApplicantName = a.ApplicantName,
			ApplicantEmail = a.ApplicantEmail,
			Phone = a.Phone,
			Address = a.Address,
			DateOfBirth = a.DateOfBirth,
			EmployerName = a.EmployerName,
			EmploymentType = a.EmploymentType,
			MonthlyIncome = a.MonthlyIncome,
			LoanAmount = a.LoanAmount,
			TenureMonths = a.TenureMonths,
			LoanPurpose = a.LoanPurpose,
			Status = a.Status.ToString(),
			StatusNote = a.StatusNote,
			CreatedAt = a.CreatedAt,
			UpdatedAt = a.UpdatedAt,
			SubmittedAt = a.SubmittedAt
		};
	}
}
