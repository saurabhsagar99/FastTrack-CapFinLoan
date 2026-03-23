using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Domain.Models;

namespace CapFinLoan.Auth.Infrastructure.Services
{
	public interface IJwtService
	{
		string GenerateToken(User user);
	}
}
