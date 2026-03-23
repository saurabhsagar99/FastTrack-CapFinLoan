using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Application.DTOs;

namespace CapFinLoan.Auth.Application.Interfaces
{
	public interface IAuthService
	{
		Task<AuthResponseDto> LoginAsync(LoginDto dto);
		Task<AuthResponseDto> RegisterAsync(RegisterDto dto);
	}
}
