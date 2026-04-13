using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CapFinLoan.Application.Persistence.Migrations
{
	public partial class AddLoanApplicationSagaState : Migration
	{
		protected override void Up(MigrationBuilder migrationBuilder)
		{
			migrationBuilder.CreateTable(
				name: "LoanApplicationSagaStates",
				schema: "core",
				columns: table => new
				{
					Id = table.Column<int>(type: "int", nullable: false)
						.Annotation("SqlServer:Identity", "1, 1"),
					ApplicationId = table.Column<int>(type: "int", nullable: false),
					CurrentStep = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
					LastEventName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
					LastMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
					IsCompleted = table.Column<bool>(type: "bit", nullable: false),
					StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
					UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
					CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
				},
				constraints: table =>
				{
					table.PrimaryKey("PK_LoanApplicationSagaStates", x => x.Id);
				});

			migrationBuilder.CreateIndex(
				name: "IX_LoanApplicationSagaStates_ApplicationId",
				schema: "core",
				table: "LoanApplicationSagaStates",
				column: "ApplicationId",
				unique: true);
		}

		protected override void Down(MigrationBuilder migrationBuilder)
		{
			migrationBuilder.DropTable(
				name: "LoanApplicationSagaStates",
				schema: "core");
		}
	}
}