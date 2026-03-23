using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Domain.Models;
using CapFinLoan.Auth.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Auth.Persistence.Repositories
{
	public class UserRepository:IUserRepository
	{
		private readonly AuthDbContext _db;

		public UserRepository(AuthDbContext db) => _db = db;

		public Task<User?> GetByEmailAsync(string email) =>
			_db.Users.FirstOrDefaultAsync(u => u.Email == email);

		public Task<User?> GetByIdAsync(Guid id) =>
			_db.Users.FindAsync(id).AsTask();

		public async Task<IEnumerable<User>> GetAllAsync() =>
			await _db.Users.ToListAsync();

		public async Task AddAsync(User user)
		{
			_db.Users.Add(user);
			await _db.SaveChangesAsync();
		}

		public async Task UpdateAsync(User user)
		{
			_db.Users.Update(user);
			await _db.SaveChangesAsync();
		}

	}
}
