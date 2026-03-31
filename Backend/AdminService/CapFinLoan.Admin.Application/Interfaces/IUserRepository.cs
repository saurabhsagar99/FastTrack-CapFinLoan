using CapFinLoan.Admin.Domain.Models;

namespace CapFinLoan.Admin.Application.Interfaces
{
	public interface IUserRepository
	{
		Task<IEnumerable<User>> GetAllAsync();
		Task<User> GetByIdAsync(string id);
		Task<User> UpdateAsync(User user);
	}
}
