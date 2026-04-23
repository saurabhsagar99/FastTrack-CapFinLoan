using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CapFinLoan.Document.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentTypeEnumAndIsRequired : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add IsRequired column first (before changing DocumentType column)
            migrationBuilder.AddColumn<bool>(
                name: "IsRequired",
                schema: "docs",
                table: "Documents",
                type: "bit",
                nullable: false,
                defaultValue: true);

            // Drop the constraint and column for DocumentType
            migrationBuilder.DropColumn(
                name: "DocumentType",
                schema: "docs",
                table: "Documents");

            // Add DocumentType as int (enum) with default value
            migrationBuilder.AddColumn<int>(
                name: "DocumentType",
                schema: "docs",
                table: "Documents",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert to string DocumentType
            migrationBuilder.DropColumn(
                name: "DocumentType",
                schema: "docs",
                table: "Documents");

            migrationBuilder.AddColumn<string>(
                name: "DocumentType",
                schema: "docs",
                table: "Documents",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            // Remove IsRequired column
            migrationBuilder.DropColumn(
                name: "IsRequired",
                schema: "docs",
                table: "Documents");
        }
    }
}
