using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Persistence.Repositories
{
	public class UserRepository : IUserRepository
	{
		// TODO: Integrate with actual database context
		// For now, this is a placeholder that can be connected to EF Core DbContext
		private static List<User> _users = new();

		public async Task<IEnumerable<User>> GetAllAsync()
		{
			return await Task.FromResult(_users.AsEnumerable());
		}

		public async Task<User> GetByIdAsync(string id)
		{
			return await Task.FromResult(_users.FirstOrDefault(u => u.Id == id));
		}

		public async Task<User> UpdateAsync(User user)
		{
			var existingUser = _users.FirstOrDefault(u => u.Id == user.Id);
			if (existingUser != null)
			{
				existingUser.IsActive = user.IsActive;
			}
			return await Task.FromResult(user);
		}
	}
}
