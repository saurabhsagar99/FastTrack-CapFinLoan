using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Auth.Application.DTOs
{
	public class AuthResponseDto
	{
		public string Token { get; set; } = string.Empty;
		public string Role { get; set; } = string.Empty;
		public string Name { get; set; } = string.Empty;
		public Guid UserId { get; set; }
	}
}
