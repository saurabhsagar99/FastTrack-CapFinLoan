using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace CapFinLoan.Auth.Application.DTOs
{
	public class RegisterDto
	{
		[Required]
		public string Name { get; set; } = string.Empty;

		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required]
		public string Phone { get; set; } = string.Empty;

		[Required, MinLength(8)]
		public string Password { get; set; } = string.Empty;
	}
}
