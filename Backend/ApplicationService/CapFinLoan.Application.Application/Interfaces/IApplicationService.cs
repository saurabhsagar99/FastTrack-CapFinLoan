using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Application.Common;
using CapFinLoan.Application.Application.DTOs;

namespace CapFinLoan.Application.Application.Interfaces
{
	public interface IApplicationService
	{
		Task<ApiResponse<ApplicationResponseDto>> CreateDraftAsync(string applicantId, CreateApplicationDto dto);
		Task<ApiResponse<ApplicationResponseDto>> UpdateDraftAsync(int id, string applicantId, UpdateApplicationDto dto);
		Task<ApiResponse<ApplicationResponseDto>> SubmitApplicationAsync(int id, string applicantId);
		Task<ApiResponse<ApplicationResponseDto>> UpdateStatusByAdminAsync(int id, UpdateApplicationStatusDto dto);
		Task<ApiResponse<IEnumerable<ApplicationResponseDto>>> GetMyApplicationsAsync(string applicantId);
		Task<ApiResponse<ApplicationResponseDto>> GetByIdAsync(int id);
		Task<ApiResponse<IEnumerable<ApplicationResponseDto>>> GetAllAsync();
	}
}
