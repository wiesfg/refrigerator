export default function MenuCard({ menuName, reason }) {
  return (
    <article className="menu-card">
      <div className="menu-card-label">추천 메뉴</div>
      <h3>{menuName}</h3>
      <p>{reason}</p>
    </article>
  );
}
