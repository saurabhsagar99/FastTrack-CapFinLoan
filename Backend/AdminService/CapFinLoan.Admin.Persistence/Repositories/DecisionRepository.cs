using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Domain.Models;
using CapFinLoan.Admin.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Admin.Persistence.Repositories
{
	public class DecisionRepository:IDecisionRepository
	{
		private readonly AdminDbContext _context;

		public DecisionRepository(AdminDbContext context)
		{
			_context = context;
		}

		public async Task<IEnumerable<Decision>> GetAllAsync() =>
			await _context.Decisions.OrderByDescending(d => d.DecisionDate).ToListAsync();

		public async Task<Decision> AddAsync(Decision decision)
		{
			_context.Decisions.Add(decision);
			await _context.SaveChangesAsync();
			return decision;
		}

		public async Task<int> CountAsync() =>
			await _context.Decisions.CountAsync();

		public async Task<int> CountByStatusAsync(string status) =>
			await _context.Decisions.CountAsync(d => d.Status == status);
	}
}
