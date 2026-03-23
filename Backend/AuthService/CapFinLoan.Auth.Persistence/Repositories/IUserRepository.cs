using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Domain.Models;

namespace CapFinLoan.Auth.Persistence.Repositories
{
	public interface IUserRepository
	{
		Task<User?> GetByEmailAsync(string email);
		Task<User?> GetByIdAsync(Guid id);
		Task<IEnumerable<User>> GetAllAsync();
		Task AddAsync(User user);
		Task UpdateAsync(User user);
	}
}
